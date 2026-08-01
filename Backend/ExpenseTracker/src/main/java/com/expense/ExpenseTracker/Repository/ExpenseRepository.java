package com.expense.ExpenseTracker.Repository;

import com.expense.ExpenseTracker.Entity.Expense;
import com.expense.ExpenseTracker.Entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByUser(User user);

    List<Expense> findByUserAndDate(User user, LocalDate date);

    List<Expense> findByUserAndDateBetween(User user, LocalDate from, LocalDate to);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.user = :user")
    Double getTotalExpenseByUser(@Param("user") User user);

}
