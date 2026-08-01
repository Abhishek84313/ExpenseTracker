package com.expense.ExpenseTracker.Service;

import com.expense.ExpenseTracker.Entity.Expense;
import com.expense.ExpenseTracker.Entity.User;
import com.expense.ExpenseTracker.Repository.ExpenseRepository;
import com.expense.ExpenseTracker.Repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.time.LocalDate;
import java.util.*;
@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    private final UserRepository userRepository;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            UserRepository userRepository
    ) {
        this.expenseRepository = expenseRepository;
        this.userRepository = userRepository;
    }

    public Double getTotalExpense(String token) {
        User user = userRepository.findByToken(token);

        return expenseRepository.getTotalExpenseByUser(user);
    }

    public Expense addExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    public void deleteExpense(Long id) {
        expenseRepository.deleteById(id);
    }

    public Expense updateExpense(Long id, Expense newExp) {
        Expense exp = expenseRepository.findById(id).orElseThrow();
        exp.setTitle(newExp.getTitle());
        exp.setAmount(newExp.getAmount());
        exp.setDate(newExp.getDate());
        exp.setCategory(newExp.getCategory());
        return expenseRepository.save(exp);
    }

    public List<Expense> getUserExpenses(User user) {
        return expenseRepository.findByUser(user);
    }

    public double getDailyTotal(User user, LocalDate date) {
        return expenseRepository.findByUserAndDate(user, date)
                .stream().mapToDouble(Expense::getAmount).sum();
    }

    public double getMonthlyTotal(User user, int month, int year) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());

        return expenseRepository.findByUserAndDateBetween(user, start, end)
                .stream().mapToDouble(Expense::getAmount).sum();
    }

    public double getYearlyTotal(User user, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);

        return expenseRepository.findByUserAndDateBetween(user, start, end)
                .stream().mapToDouble(Expense::getAmount).sum();
    }

    public Map<String, Double> getSavings(User user, int month, int year) {
        double currentMonth = getMonthlyTotal(user, month, year);

        int prevMonth = month == 1 ? 12 : month - 1;
        int prevYear = month == 1 ? year - 1 : year;

        double previousMonth = getMonthlyTotal(user, prevMonth, prevYear);

        Map<String, Double> map = new HashMap<>();
        map.put("currentMonth", currentMonth);
        map.put("previousMonth", previousMonth);
        map.put("savings", previousMonth - currentMonth);
        return map;
    }
}
