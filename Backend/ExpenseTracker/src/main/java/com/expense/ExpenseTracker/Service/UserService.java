package com.expense.ExpenseTracker.Service;

import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository repo;
    private final PasswordEncoder encoder;

    public UserService(UserRepository repo, PasswordEncoder encoder) {
        this.repo = repo;
        this.encoder = encoder;
    }

    public User signup(User user) {
        user.setPassword(encoder.encode(user.getPassword()));
        return repo.save(user);
    }

    public String login(String username, String password) {
        User user = repo.findByUsername(username);

        if (user == null || !encoder.matches(password, user.getPassword()))
            return null;

        String token = UUID.randomUUID().toString();
        user.setToken(token);
        repo.save(user);

        return token;
    }

    public User findByToken(String token) {
        return repo.findByToken(token);
    }
}
