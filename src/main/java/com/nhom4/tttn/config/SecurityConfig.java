package com.nhom4.tttn.config;

import com.nhom4.tttn.service.DatabaseUserDetailsService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(
            DatabaseUserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }


    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            DaoAuthenticationProvider authenticationProvider,
            SecurityContextRepository securityContextRepository
    ) throws Exception {
        http
                .authenticationProvider(authenticationProvider)
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/css/**", "/js/**", "/img/**", "/uploads/**", "/error/**").permitAll()
                        .requestMatchers("/products/new", "/products/form", "/products/*/edit", "/products/*/form").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/auth/google").permitAll()
                        .requestMatchers(HttpMethod.POST, "/products/save", "/products/*/delete", "/categories/**", "/attributes/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/", "/products/**", "/contact", "/login", "/forgot-password", "/register").permitAll()
                        .anyRequest().authenticated()
                )
                .formLogin(form -> form
                        .loginPage("/login")
                        .usernameParameter("email")
                        .passwordParameter("password")
                        .defaultSuccessUrl("/products", true)
                        .failureUrl("/login?error")
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/")
                        .invalidateHttpSession(true)
                        .deleteCookies("NHOM4_SESSION")
                );
        return http.build();
    }
}
