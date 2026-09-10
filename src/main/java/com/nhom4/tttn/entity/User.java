package com.nhom4.tttn.entity;

import com.nhom4.tttn.enums.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    @Setter
    private String name;

    @Column(nullable = false, unique = true, length = 180)
    @Setter
    private String email;

    @Column(name = "google_sub", unique = true, length = 128)
    @Setter
    private String googleSub;

    @Column(nullable = false, length = 100)
    @Setter
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Setter
    private Role role = Role.USER;

    @Column(nullable = false)
    @Setter
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @PrePersist
    void prePersist() {
        createdDate = LocalDateTime.now();
    }

}
