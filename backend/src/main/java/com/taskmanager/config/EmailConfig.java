package com.taskmanager.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

/**
 * SMTP mail configuration. Builds the {@link JavaMailSender} explicitly from
 * environment-provided credentials so nothing sensitive lives in source or
 * committed config.
 *
 * <p>Defaults target Gmail ({@code smtp.gmail.com:587}, STARTTLS). Set
 * {@code MAIL_USERNAME} and {@code MAIL_PASSWORD} (a Gmail <b>App Password</b>,
 * not the account password) in the environment.
 */
@Configuration
public class EmailConfig {

    private static final Logger log = LoggerFactory.getLogger(EmailConfig.class);

    @Value("${MAIL_HOST:smtp.gmail.com}")
    private String host;

    @Value("${MAIL_PORT:587}")
    private int port;

    @Value("${MAIL_USERNAME:}")
    private String username;

    @Value("${MAIL_PASSWORD:}")
    private String password;

    @Bean
    public JavaMailSender mailSender() {
        // Google displays App Passwords as "abcd efgh ijkl mnop"; strip spaces
        // so a copy-pasted value with spaces still authenticates.
        String cleanUsername = username == null ? "" : username.trim();
        String cleanPassword = password == null ? "" : password.replaceAll("\\s", "");

        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host);
        sender.setPort(port);
        sender.setUsername(cleanUsername);
        sender.setPassword(cleanPassword);
        sender.setDefaultEncoding("UTF-8");

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.starttls.required", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.writetimeout", "5000");

        if (username.isBlank() || password.isBlank()) {
            log.warn("===============================================================================");
            log.warn(" MAIL_USERNAME / MAIL_PASSWORD are not set.");
            log.warn(" The app will start, but sending email will FAIL until you provide them:");
            log.warn("   MAIL_USERNAME=<your-gmail>  MAIL_PASSWORD=<16-char Gmail App Password>");
            log.warn("===============================================================================");
        } else {
            log.info("SMTP mail configured for host={}:{} as user '{}'.", host, port, username);
        }
        return sender;
    }
}
