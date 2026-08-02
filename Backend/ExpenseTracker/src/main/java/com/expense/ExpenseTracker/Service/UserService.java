package com.expense.ExpenseTracker.Service;

import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Exception.DuplicateUsernameException;
import com.expense.ExpenseTracker.Repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
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
        if (repo.findByUsername(user.getUsername()) != null)
            throw new DuplicateUsernameException(user.getUsername());

        user.setPassword(encoder.encode(user.getPassword()));

        try {
            return repo.save(user);
        } catch (DataIntegrityViolationException ex) {
            // Two concurrent signups can both pass the check above; the unique
            // index on username is what actually decides the winner.
            throw new DuplicateUsernameException(user.getUsername());
        }
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
