package com.careerpilot.backend.docengine;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import jakarta.annotation.PreDestroy;

import org.apache.fontbox.ttf.TTFParser;
import org.apache.fontbox.ttf.TTFSubsetter;
import org.apache.fontbox.ttf.TrueTypeFont;
import org.apache.fontbox.ttf.CmapLookup;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.RandomAccessReadBuffer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.careerpilot.backend.common.ApiException;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.outputdevice.helper.ExternalResourceControlPriority;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

/**
 * Prints XHTML from {@link DocWriter} to PDF with OpenHTMLtoPDF (pure Java, no browser).
 *
 * Safety and resource limits:
 * <ul>
 *   <li>No external resources: every image, stylesheet, font or file reference is refused before it's
 *       resolved, so a document can never make the server fetch a URL or read a local file (no SSRF).</li>
 *   <li>Fonts are our bundled OFL fonts, embedded and subset, so text stays selectable and searchable (ATS).</li>
 *   <li>Rendering happens in memory (no temporary files), on a small bounded pool, with a timeout and
 *       caps on output size and page count.</li>
 * </ul>
 */
@Component
public class PdfDocumentConverter {

    private static final Logger log = LoggerFactory.getLogger(PdfDocumentConverter.class);

    /** Never fetched: relative references resolve here and are then refused by the access control. */
    private static final String BASE_URI = "https://documents.careerpilot.invalid/";

    /** Sharp enough on phones and laptops; an A4 page is about 990 × 1400 pixels. */
    private static final float PREVIEW_DPI = 120;

    /** A finished PDF. */
    public record RenderedPdf(byte[] bytes, int pages) {
    }

    private final DocumentProperties limits;
    private final List<byte[]> fontBytes;
    private final ThreadPoolExecutor pool;

    public PdfDocumentConverter(DocumentProperties limits) {
        this.limits = limits;
        this.fontBytes = DocFonts.FILES.stream().map(PdfDocumentConverter::readFont).toList();
        AtomicInteger threads = new AtomicInteger();
        this.pool = new ThreadPoolExecutor(limits.maxConcurrent(), limits.maxConcurrent(), 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(Math.max(1, limits.maxQueued())), runnable -> {
                    Thread thread = new Thread(runnable, "pdf-render-" + threads.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                });
    }

    /**
     * @throws ApiException 422 when the document is too long, 503 when the server is busy or rendering
     *                      timed out, 500 when rendering failed
     */
    public RenderedPdf convert(String xhtml) {
        return onPool(() -> render(xhtml));
    }

    /**
     * Draws each page of a PDF we generated as a PNG (same pool, timeout and page cap as {@link #convert}).
     * Used for the preview, so it shows exactly what the PDF will look like, page breaks included.
     */
    public List<byte[]> pageImages(byte[] pdf) {
        return onPool(() -> {
            try (PDDocument document = Loader.loadPDF(pdf)) {
                PDFRenderer renderer = new PDFRenderer(document);
                List<byte[]> images = new ArrayList<>();
                int pages = Math.min(document.getNumberOfPages(), limits.maxPages());
                for (int i = 0; i < pages; i++) {
                    BufferedImage image = renderer.renderImageWithDPI(i, PREVIEW_DPI, ImageType.RGB);
                    ByteArrayOutputStream png = new ByteArrayOutputStream();
                    writePng(image, png);
                    images.add(png.toByteArray());
                }
                return List.copyOf(images);
            }
        });
    }

    /**
     * PNG with light compression: about 40% faster to encode than the default for ~20% larger images (an A4 page
     * is ~75 KB). Encoding was the slowest step of a preview.
     */
    private static void writePng(BufferedImage image, ByteArrayOutputStream out) throws IOException {
        javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("png").next();
        try (javax.imageio.stream.ImageOutputStream stream = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(stream);
            javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.9f);
            writer.write(null, new javax.imageio.IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
    }

    private <T> T onPool(Callable<T> task) {
        Future<T> job;
        try {
            job = pool.submit(task);
        } catch (RejectedExecutionException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_BUSY",
                    "Lots of documents are being created right now. Please try again in a moment.");
        }
        try {
            return job.get(limits.renderTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            job.cancel(true);
            log.warn("PDF rendering timed out after {}", limits.renderTimeout());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_TIMEOUT",
                    "Creating the PDF took too long. Try a shorter document or try again.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            job.cancel(true);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DOCUMENT_TIMEOUT", "PDF creation was interrupted.");
        } catch (ExecutionException e) {
            if (e.getCause() instanceof ApiException api) {
                throw api;
            }
            // Class name only: the message could quote document content.
            log.warn("PDF rendering failed: {}", e.getCause() == null ? "unknown" : e.getCause().getClass().getName());
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DOCUMENT_RENDER_FAILED",
                    "We couldn't create the PDF. Please try again.");
        }
    }

    private RenderedPdf render(String xhtml) throws IOException {
        LimitedOutputStream out = new LimitedOutputStream(limits.maxPdfSize().toBytes());
        PdfRendererBuilder builder = new PdfRendererBuilder()
                .useFastMode()
                .usePdfUaAccessibility(true)
                .withProducer("CareerPilot")
                .withHtmlContent(xhtml, BASE_URI)
                .useUriResolver((baseUri, uri) -> null)
                .useExternalResourceAccessControl((uri, type) -> false, ExternalResourceControlPriority.RUN_BEFORE_RESOLVING_URI)
                .useExternalResourceAccessControl((uri, type) -> false, ExternalResourceControlPriority.RUN_AFTER_RESOLVING_URI)
                .toStream(out);
        for (int i = 0; i < DocFonts.FILES.size(); i++) {
            DocFonts.BundledFont font = DocFonts.FILES.get(i);
            byte[] bytes = fontBytes.get(i);
            builder.useFont(() -> new ByteArrayInputStream(bytes), font.family(), font.weight(), font.style(), true);
        }
        try {
            builder.run();
        } catch (OutputTooLargeException e) {
            throw tooLarge();
        }

        byte[] pdf = out.toByteArray();
        int pages;
        try (PDDocument document = Loader.loadPDF(pdf)) {
            pages = document.getNumberOfPages();
        }
        if (pages > limits.maxPages()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "DOCUMENT_TOO_LONG",
                    "This document would be " + pages + " pages. The limit is " + limits.maxPages()
                            + "; shorten some sections and try again.");
        }
        return new RenderedPdf(pdf, pages);
    }

    private ApiException tooLarge() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "DOCUMENT_TOO_LARGE",
                "This document is too large to create. Shorten some sections and try again.");
    }

    private static byte[] readFont(DocFonts.BundledFont font) {
        try (InputStream in = new ClassPathResource("docengine/fonts/" + font.file()).getInputStream()) {
            return withoutLigatures(in.readAllBytes());
        } catch (IOException e) {
            throw new IllegalStateException("Missing bundled font " + font.file(), e);
        }
    }

    /**
     * Rewrites the font with every character but without its GSUB table. PDFBox 3 applies GSUB ligatures
     * ("f"+"t" → one glyph) whose text mapping is lost, so "Software" would be extracted as "So ware" by
     * copy-paste and by applicant tracking systems. Plain glyphs keep the PDF text exact.
     */
    static byte[] withoutLigatures(byte[] ttf) throws IOException {
        try (TrueTypeFont font = new TTFParser().parse(new RandomAccessReadBuffer(ttf))) {
            TTFSubsetter subsetter = new TTFSubsetter(font, List.of(
                    "head", "hhea", "loca", "maxp", "cvt ", "prep", "glyf", "hmtx", "fpgm", "gasp", "name", "OS/2", "post", "cmap"));
            CmapLookup cmap = font.getUnicodeCmapLookup();
            Set<Integer> codePoints = new HashSet<>();
            for (int gid = 0; gid < font.getNumberOfGlyphs(); gid++) {
                List<Integer> codes = cmap.getCharCodes(gid);
                if (codes != null) {
                    // The subsetter writes a BMP-only cmap; emoji and other astral characters are dropped
                    codes.stream().filter(code -> code <= 0xFFFF).forEach(codePoints::add);
                }
            }
            subsetter.addAll(codePoints);
            ByteArrayOutputStream out = new ByteArrayOutputStream(ttf.length);
            subsetter.writeToStream(out);
            return out.toByteArray();
        }
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    private static final class OutputTooLargeException extends IOException {
        OutputTooLargeException() {
            super("PDF output exceeded the size limit");
        }
    }

    /** Keeps a runaway document from using unbounded memory. */
    private static final class LimitedOutputStream extends OutputStream {
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        private final long max;

        LimitedOutputStream(long max) {
            this.max = max;
        }

        @Override
        public void write(int b) throws IOException {
            ensureRoom(1);
            buffer.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            ensureRoom(len);
            buffer.write(b, off, len);
        }

        private void ensureRoom(int len) throws IOException {
            if (buffer.size() + (long) len > max) {
                throw new OutputTooLargeException();
            }
        }

        byte[] toByteArray() {
            return buffer.toByteArray();
        }
    }
}
