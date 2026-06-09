package com.example.customer;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

  @PostMapping
  public ResponseEntity<CustomerResponse> createCustomer(@RequestBody CustomerRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(new CustomerResponse("cus-100", request.name()));
  }

  @GetMapping("/{customerId}")
  public ResponseEntity<CustomerResponse> getCustomer(@PathVariable String customerId) {
    return ResponseEntity.ok(new CustomerResponse(customerId, "Jane Doe"));
  }
}

record CustomerRequest(String name, String documentNumber) {}

record CustomerResponse(String id, String name) {}
