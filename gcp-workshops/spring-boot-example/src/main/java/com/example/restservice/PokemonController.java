package com.example.restservice;

import java.util.Optional;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.beans.factory.annotation.Autowired;

@RestController
public class PokemonController {
    @Autowired
    private PokemonRepository pokemonRepository;

	@GetMapping("/pokemon")
	public PokemonEntity getPokemon(
		@RequestParam(value = "id", defaultValue = "0") String id)
	{
		Long pokemonId = Long.parseLong(id);

		Optional<PokemonEntity> pokemon = pokemonRepository.findById(pokemonId);
		
        if (pokemon.isPresent()) {
			return pokemon.get();
        } else {
            System.out.printf("No Pokemon found with id %d%n", pokemonId);
			return null;
        }
	}
}
