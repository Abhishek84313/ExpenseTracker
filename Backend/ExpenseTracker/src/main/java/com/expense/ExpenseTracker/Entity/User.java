package com.expense.ExpenseTracker.Entity;


import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    // Accepted on signup/login requests, never written back to a response.
    // Expense serialises its owning User, so without this the BCrypt hash
    // would ship with every expense in the list.
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    // Session token is handed out by /api/auth/login as a bare string and
    // must never leak through any other serialised User.
    @JsonIgnore
    private String token;

    // getters & setters
}
