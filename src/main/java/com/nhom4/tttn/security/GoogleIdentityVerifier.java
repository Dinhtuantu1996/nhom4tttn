package com.nhom4.tttn.security;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.nhom4.tttn.dto.GoogleUserInfo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Locale;

@Component
public class GoogleIdentityVerifier {
    private final String clientId;
    private final GoogleIdTokenVerifier verifier;

    public GoogleIdentityVerifier(@Value("${app.google.client-id:}") String clientId) throws Exception {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.verifier = this.clientId.isBlank()
                ? null
                : new GoogleIdTokenVerifier.Builder(
                        GoogleNetHttpTransport.newTrustedTransport(),
                        GsonFactory.getDefaultInstance()
                ).setAudience(Collections.singletonList(this.clientId)).build();
    }

    public GoogleUserInfo verify(String credential) {
        if (clientId.isBlank() || verifier == null) {
            throw new IllegalStateException("Đăng nhập Google hiện chưa khả dụng.");
        }
        if (credential == null || credential.isBlank()) {
            throw new IllegalArgumentException("Google credential không hợp lệ.");
        }

        try {
            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new IllegalArgumentException("Google credential không hợp lệ.");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            String sub = payload.getSubject();
            String email = payload.getEmail();
            Boolean emailVerified = payload.getEmailVerified();
            String name = (String) payload.get("name");

            if (sub == null || sub.isBlank()) {
                throw new IllegalArgumentException("Không đọc được tài khoản Google.");
            }
            if (email == null || email.isBlank()) {
                throw new IllegalArgumentException("Tài khoản Google không có email.");
            }
            if (!Boolean.TRUE.equals(emailVerified)) {
                throw new IllegalArgumentException("Email Google chưa được xác thực.");
            }

            return new GoogleUserInfo(
                    sub.trim(),
                    email.trim().toLowerCase(Locale.ROOT),
                    name == null ? null : name.trim()
            );
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Không thể xác thực tài khoản Google.", exception);
        }
    }
}
