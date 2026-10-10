package com.careerpilot.backend.discovery;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Titles taken from the real boards we read (Databricks, Stripe, OpenAI, CRED, Groww, ...). */
class TechRoleClassifierTest {

    @ParameterizedTest(name = "{0} -> {2}")
    @CsvSource(delimiter = '|', nullValues = "-", textBlock = """
            Senior Software Engineer - Backend        | -                     | BACKEND
            Backend Engineer, Payments                | Engineering           | BACKEND
            Software Engineer (Backend - SDE 2)       | -                     | BACKEND
            Java Developer                            | -                     | BACKEND
            Senior Distributed Systems Engineer       | -                     | BACKEND
            Senior Frontend Engineer                  | -                     | FRONTEND
            Front-End Developer (React)               | -                     | FRONTEND
            Full Stack Engineer                       | -                     | FULL_STACK
            Android Engineer                          | -                     | MOBILE
            iOS Developer                             | -                     | MOBILE
            Site Reliability Engineer                 | -                     | DEVOPS
            Senior Production Engineer - Realtime     | -                     | DEVOPS
            Platform Engineer, Kubernetes             | -                     | DEVOPS
            Machine Learning Engineer                 | -                     | DATA_ML
            Data Engineer II                          | -                     | DATA_ML
            Research Engineer, Post-Training          | -                     | DATA_ML
            SDET                                      | -                     | QA
            QA Automation Engineer                    | -                     | QA
            Security Engineer, AppSec                 | -                     | SECURITY
            Software Engineer, API Agents             | -                     | BACKEND
            Software Engineer, Operator Tooling       | -                     | GENERAL
            Member of Technical Staff                 | -                     | GENERAL
            Engineering Manager, Growth               | -                     | GENERAL
            Sr. Automation Engineer - IT Asset Mgmt   | -                     | GENERAL
            Staff Engineer                            | -                     | GENERAL
            Compiler Hacker                           | Engineering           | GENERAL
            """)
    void classifiesTechJobs(String title, String department, TechRole expected) {
        assertThat(TechRoleClassifier.classify(title, department)).contains(expected);
    }

    @ParameterizedTest(name = "{0} is not a tech job")
    @CsvSource(delimiter = '|', nullValues = "-", textBlock = """
            Product Design New Grad (2027 Start)      | -
            Support Program Manager, Partnerships     | User Operations
            Market Research Lead, ChatGPT             | Marketing
            Account Executive, Enterprise             | -
            Solutions Architect Greenfield Enterprise | -
            Sales Engineer                            | -
            Global Demo Engineer                      | Sales
            Technical Recruiter                       | -
            Assistant Manager - Internal Audit        | -
            Hardware Engineer, Datacenter             | -
            Data Analyst                              | Finance
            accounts payable manager                  | finance
            Sr Staff Technical Program Manager- Security | -
            Director, Product Management, Security    | -
            Deputy Facility Security Officer          | -
            """)
    void dropsNonTechJobs(String title, String department) {
        assertThat(TechRoleClassifier.classify(title, department)).isEmpty();
    }
}
