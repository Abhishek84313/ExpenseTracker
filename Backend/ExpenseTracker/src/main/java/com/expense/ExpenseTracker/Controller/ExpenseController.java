package com.expense.ExpenseTracker.Controller;

import com.expense.ExpenseTracker.Entity.Expense;
import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Repository.ExpenseRepository;
import com.expense.ExpenseTracker.Service.ExpenseService;
import com.expense.ExpenseTracker.Service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin
public class ExpenseController {

    private final ExpenseService service;
    private final UserService userService;
    @Autowired
    private ExpenseRepository repo;

    public ExpenseController(ExpenseService service, UserService userService) {
        this.service = service;
        this.userService = userService;
    }

    private User authenticate(String token) {
        return userService.findByToken(token);
    }

    public List<Expense> getByDateRange(User user, String from, String to) {
        return repo.findByUserAndDateBetween(
                user,
                LocalDate.parse(from),
                LocalDate.parse(to)
        );
    }



    @GetMapping
    public List<Expense> getExpenses(@RequestHeader("Authorization") String token) {
        return service.getUserExpenses(authenticate(token));
    }

    @PostMapping
    public Expense addExpense(@RequestHeader("Authorization") String token, @RequestBody Expense expense) {
        expense.setUser(authenticate(token));
        return service.addExpense(expense);
    }

    @PutMapping("/{id}")
    public Expense update(@RequestHeader("Authorization") String token, @PathVariable Long id, @RequestBody Expense expense) {
        authenticate(token);
        return service.updateExpense(id, expense);
    }

    @DeleteMapping("/{id}")
    public void delete(@RequestHeader("Authorization") String token, @PathVariable Long id) {
        authenticate(token);
        service.deleteExpense(id);
    }

    @GetMapping("/daily")
    public double daily(@RequestHeader("Authorization") String token, @RequestParam String date) {
        return service.getDailyTotal(authenticate(token), LocalDate.parse(date));
    }

    @GetMapping("/monthly")
    public double monthly(@RequestHeader("Authorization") String token, @RequestParam int month, @RequestParam int year) {
        return service.getMonthlyTotal(authenticate(token), month, year);
    }

    @GetMapping("/yearly")
    public double yearly(@RequestHeader("Authorization") String token, @RequestParam int year) {
        return service.getYearlyTotal(authenticate(token), year);
    }

    @GetMapping("/savings")
    public Map<String, Double> savings(@RequestHeader("Authorization") String token, @RequestParam int month, @RequestParam int year) {
        return service.getSavings(authenticate(token), month, year);
    }

    @GetMapping("/total")
    public ResponseEntity<Double> getTotalExpense(
            @RequestHeader("Authorization") String token
    ) {
        return ResponseEntity.ok(service.getTotalExpense(token));
    }
}
