package com.example.newscrawler.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "primitive_users")
public class PrimitiveUser extends AppUser {

    public PrimitiveUser() {
        setType(UserType.PRIMITIVE);
    }
}
