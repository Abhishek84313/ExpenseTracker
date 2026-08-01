package com.expense.ExpenseTracker.Service;

import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository repo;

    public UserService(UserRepository repo) {
        this.repo = repo;
    }

    public User signup(User user) {
        return repo.save(user);
    }

    public String login(String username, String password) {
        User user = repo.findByUsername(username);

        if (user == null || !user.getPassword().equals(password))
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
