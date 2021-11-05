package com.example.restservice;

import javax.persistence.*;

@Entity
@Table(name = "Pokemon")
public class PokemonEntity {
    private long id;
    private String name;
    
    public PokemonEntity() { 
    }

    public PokemonEntity(String name) {
        this.name = name;
    }
    
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "ID", nullable = false)
    public long getId() {
        return this.id;
    }
    public void setId(long id) {
        this.id = id;
    }
 
    @Column(name = "name", nullable = false)
    public String getName() {
        return this.name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
}