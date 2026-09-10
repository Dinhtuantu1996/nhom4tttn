package com.nhom4.tttn.service;

import com.nhom4.tttn.dto.GoogleUserInfo;
import com.nhom4.tttn.entity.User;
import com.nhom4.tttn.enums.Role;
import com.nhom4.tttn.repository.UserRepository;
import com.nhom4.tttn.security.GoogleIdentityVerifier;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GoogleLoginService {
    private final UserRepository userRepository;
    private final GoogleIdentityVerifier googleIdentityVerifier;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public User login(String credential) {
        GoogleUserInfo googleUser = googleIdentityVerifier.verify(credential);
        User user = userRepository.findByGoogleSub(googleUser.sub())
                .orElseGet(() -> linkOrCreate(googleUser));

        if (!user.isActive()) {
            throw new IllegalStateException("Tài khoản đã bị khóa.");
        }

        String googleName = normalizeName(googleUser.name(), googleUser.email());
        if (!googleName.equals(user.getName())) {
            user.setName(googleName);
            user = userRepository.save(user);
        }
        return user;
    }

    private User linkOrCreate(GoogleUserInfo googleUser) {
        return userRepository.findByEmailIgnoreCase(googleUser.email())
                .map(user -> {
                    if (user.getGoogleSub() != null && !user.getGoogleSub().equals(googleUser.sub())) {
                        throw new IllegalStateException("Email đã được liên kết với tài khoản Google khác.");
                    }
                    user.setGoogleSub(googleUser.sub());
                    return userRepository.save(user);
                })
                .orElseGet(() -> createGoogleUser(googleUser));
    }

    private User createGoogleUser(GoogleUserInfo googleUser) {
        User user = new User();
        user.setName(normalizeName(googleUser.name(), googleUser.email()));
        user.setEmail(googleUser.email());
        user.setGoogleSub(googleUser.sub());
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole(Role.USER);
        user.setActive(true);
        return userRepository.save(user);
    }

    private String normalizeName(String name, String email) {
        String value = name == null || name.isBlank() ? email : name.trim();
        return value.length() <= 120 ? value : value.substring(0, 120);
    }
}
