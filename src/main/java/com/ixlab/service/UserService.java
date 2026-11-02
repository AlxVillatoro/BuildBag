package com.ixlab.service;

import com.ixlab.domain.User;
import com.ixlab.exception.ApiException;
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
        if (userRepository.findByUsername(username).isPresent()) {
            throw ApiException.conflict("Ese nombre de usuario ya existe");
        }
        User u = new User();
        u.setUsername(username);
        u.setPasswordHash(BCrypt.hashpw(password, BCrypt.gensalt()));
        return userRepository.save(u);
    }

    public Optional<User> authenticate(String username, String password) {
        return userRepository.findByUsername(username)
            .filter(u -> BCrypt.checkpw(password, u.getPasswordHash()));
    }
}
