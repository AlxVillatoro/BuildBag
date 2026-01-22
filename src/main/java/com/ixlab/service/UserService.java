package com.ixlab.service;

import com.ixlab.domain.User;
import com.ixlab.repository.UserRepository;

import jakarta.inject.Singleton;

import org.mindrot.jbcrypt.BCrypt;

import java.util.Optional;

@Singleton
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User register(String username, String password) {
        String hash = BCrypt.hashpw(password, BCrypt.gensalt());
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(hash);
        return userRepository.save(u);
    }

    public Optional<User> authenticate(String username, String password) {
        Optional<User> o = userRepository.findByUsername(username);
        if (!o.isPresent()) return Optional.empty();
        User u = o.get();
        if (BCrypt.checkpw(password, u.getPasswordHash())) {
            return Optional.of(u);
        }
        return Optional.empty();
    }
}
