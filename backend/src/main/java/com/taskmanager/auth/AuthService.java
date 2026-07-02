package com.taskmanager.auth;

import com.taskmanager.auth.dto.AuthResponse;
import com.taskmanager.auth.dto.LoginRequest;
import com.taskmanager.auth.dto.RegisterRequest;
import com.taskmanager.exception.EmailAlreadyExistsException;
import com.taskmanager.security.JwtService;
import com.taskmanager.user.Role;
import com.taskmanager.user.User;
import com.taskmanager.user.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       JwtService jwtService, AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new EmailAlreadyExistsException("Email is already registered: " + request.email());
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role(Role.ROLE_USER)
                .build();

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved);
        return AuthResponse.of(token, saved);
    }

    public AuthResponse login(LoginRequest request) {
        // Throws BadCredentialsException on failure -> handled globally as 401.
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password()));

        User user = (User) authentication.getPrincipal();
        String token = jwtService.generateToken(user);
        return AuthResponse.of(token, user);
    }
}
