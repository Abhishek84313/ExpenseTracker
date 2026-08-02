package com.expense.ExpenseTracker.Exception;

public class DuplicateUsernameException extends RuntimeException {

    public DuplicateUsernameException(String username) {
        super("Username '" + username + "' is already taken");
    }
}
