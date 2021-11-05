package com.example.restservice;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GreetingController {

	private static final String template = "Hello, %s!";
	private final AtomicLong counter = new AtomicLong();

	@GetMapping("/greeting")
	public Greeting greeting(@RequestParam(value = "name", defaultValue = "World") String name) {
		long c = counter.incrementAndGet();
		String logTemplate = "{\"endpoint\": \"/greeting\", \"name\": \"%s\", \"count\": %d}";
		System.out.println(String.format(logTemplate, name, c));
		return new Greeting(c, String.format(template, name));
	}
}
