package com.expense.ExpenseTracker.Controller;

import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Service.ExpenseService;
import com.expense.ExpenseTracker.Service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:5173")
public class UserController {

    private final UserService userService;

    private final ExpenseService expenseService;

    @GetMapping("/profile")
    public ResponseEntity<Map<String, String>> getProfile(
            @RequestHeader("Authorization") String token
    ) {
        User user = userService.findByToken(token);

        Map<String, String> response = new HashMap<>();
        response.put("email", user.getUsername());

        return ResponseEntity.ok(response);
    }
}
