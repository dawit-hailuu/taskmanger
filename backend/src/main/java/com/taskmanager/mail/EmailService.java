package com.taskmanager.mail;

import com.taskmanager.exception.EmailSendException;
import com.taskmanager.user.User;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;

/**
 * Sends the transactional emails used by the auth flows over real SMTP.
 * Composes professional HTML templates and delegates delivery to
 * {@link JavaMailSender}. Any delivery failure surfaces as
 * {@link EmailSendException} so callers can react (e.g. roll back registration).
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private static final long VERIFICATION_HOURS = 24;
    private static final long RESET_MINUTES = 60;

    private final JavaMailSender mailSender;
    private final String appName;
    private final String from;
    private final String frontendBaseUrl;

    public EmailService(JavaMailSender mailSender,
                        @Value("${app.name:Taskflow}") String appName,
                        @Value("${app.mail.from}") String from,
                        @Value("${app.frontend.base-url}") String frontendBaseUrl) {
        this.mailSender = mailSender;
        this.appName = appName;
        this.from = from;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    // ---- public API ----

    public void sendVerificationEmail(User user, String rawToken) {
        String link = buildLink("/verify-email", rawToken);
        String body = verificationTemplate(user.getName(), link);
        send(user.getEmail(), appName + " — verify your email address", body);
    }

    public void sendPasswordResetEmail(User user, String rawToken) {
        String link = buildLink("/reset-password", rawToken);
        String body = resetTemplate(user.getName(), link);
        send(user.getEmail(), appName + " — reset your password", body);
    }

    public void sendPasswordChangedEmail(User user) {
        String body = passwordChangedTemplate(user.getName());
        send(user.getEmail(), appName + " — your password was changed", body);
    }

    // ---- delivery ----

    private void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(message);
            log.info("Sent '{}' email to {}", subject, to);
        } catch (MessagingException | MailException ex) {
            // Log the full exception (with SMTP server reply) so the real cause
            // — e.g. "535-5.7.8 Username and Password not accepted" — is visible.
            log.error("Failed to send email to {}. Root cause: {}", to, rootCauseMessage(ex), ex);
            throw new EmailSendException("Could not send email to " + to, ex);
        }
    }

    private String rootCauseMessage(Throwable t) {
        Throwable cause = t;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        return cause.getMessage();
    }

    private String buildLink(String path, String rawToken) {
        return UriComponentsBuilder.fromUriString(frontendBaseUrl)
                .path(path)
                .queryParam("token", rawToken)
                .build()
                .toUriString();
    }

    // ---- templates ----

    private String verificationTemplate(String name, String link) {
        return layout(
                "Welcome to " + appName + " 🎉",
                "Hi " + escape(name) + ",",
                "Thanks for signing up. Please confirm your email address to activate your account and get started.",
                "Verify my email", link,
                "This link expires in " + VERIFICATION_HOURS + " hours. "
                        + "If you didn't create a " + appName + " account, you can safely ignore this email.");
    }

    private String resetTemplate(String name, String link) {
        return layout(
                "Reset your password",
                "Hi " + escape(name) + ",",
                "We received a request to reset your " + appName + " password. Choose a new one using the button below.",
                "Reset my password", link,
                "This link expires in " + RESET_MINUTES + " minutes. "
                        + "If you didn't request this, your password remains unchanged.");
    }

    private String passwordChangedTemplate(String name) {
        return layout(
                "Your password was changed",
                "Hi " + escape(name) + ",",
                "This is a confirmation that your " + appName + " password was just changed.",
                null, null,
                "If this wasn't you, please reset your password immediately and contact support.");
    }

    /** Shared responsive email shell with an optional call-to-action button. */
    private String layout(String heading, String greeting, String intro,
                          String ctaLabel, String ctaUrl, String footer) {
        String button = (ctaLabel != null && ctaUrl != null)
                ? """
                  <tr><td style="padding:8px 0 4px;">
                    <a href="%s" style="background:#3d4ee0;color:#ffffff;text-decoration:none;
                       padding:13px 26px;border-radius:8px;font-weight:600;display:inline-block;
                       font-size:15px;">%s</a>
                  </td></tr>
                  <tr><td style="padding:16px 0 0;font-size:13px;color:#6b7688;line-height:1.5;">
                    Or paste this link into your browser:<br>
                    <a href="%s" style="color:#3d4ee0;word-break:break-all;">%s</a>
                  </td></tr>
                  """.formatted(ctaUrl, ctaLabel, ctaUrl, ctaUrl)
                : "";

        return """
               <!doctype html>
               <html>
                 <body style="margin:0;background:#eef1f6;padding:24px;
                              font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif;color:#171c28;">
                   <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                     <tr><td align="center">
                       <table role="presentation" width="520" cellpadding="0" cellspacing="0"
                              style="background:#ffffff;border:1px solid #dfe4ee;border-radius:14px;
                                     overflow:hidden;max-width:520px;width:100%%;">
                         <tr><td style="background:#3d4ee0;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
                         <tr><td style="padding:32px 36px;">
                           <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                             <tr><td style="font-size:13px;font-weight:700;letter-spacing:.08em;
                                            text-transform:uppercase;color:#3d4ee0;padding-bottom:12px;">%s</td></tr>
                             <tr><td style="font-size:22px;font-weight:700;padding-bottom:16px;">%s</td></tr>
                             <tr><td style="font-size:15px;padding-bottom:8px;">%s</td></tr>
                             <tr><td style="font-size:15px;color:#3b4453;line-height:1.6;padding-bottom:20px;">%s</td></tr>
                             %s
                             <tr><td style="border-top:1px solid #dfe4ee;margin-top:24px;padding-top:20px;
                                            font-size:12px;color:#9aa4b5;line-height:1.6;">%s</td></tr>
                           </table>
                         </td></tr>
                       </table>
                       <p style="font-size:12px;color:#9aa4b5;margin:16px 0 0;">© %s</p>
                     </td></tr>
                   </table>
                 </body>
               </html>
               """.formatted(appName, heading, greeting, intro, button, footer, appName);
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
