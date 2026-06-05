package com.example.newscrawler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.host}")
    private String mailHost;

    public void sendVerificationCode(String to, String code) {
        String subject = "Confirm your NewsBridge account";
        String body = "Your email confirmation code is: " + code + "\n\n"
                    + "This code will expire in 15 minutes.\n\n"
                    + "If you did not create an account, please ignore this email.";
        sendEmail(to, subject, body);
    }

    public void sendPasswordResetCode(String to, String code) {
        String subject = "Reset your NewsBridge password";
        String body = "Your password reset code is: " + code + "\n\n"
                    + "This code will expire in 15 minutes.\n\n"
                    + "If you did not request a password reset, please ignore this email.";
        sendEmail(to, subject, body);
    }

    private void sendEmail(String to, String subject, String body) {
        // If no SMTP server is configured, log the email to console
        if (mailSender == null || "localhost".equals(mailHost)) {
            log.info("\n===== EMAIL (DEV MODE) =====\nTo: {}\nSubject: {}\nBody:\n{}\n============================", to, subject, body);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            log.info("Email sent successfully to {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}