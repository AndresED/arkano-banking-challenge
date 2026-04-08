# Kafka Architecture

## Overview

The system uses **Apache Kafka** as the event bus for communication between microservices.

Each microservice:

- Publishes events to Kafka topics
- Consumes events from Kafka topics
- Processes events asynchronously

This allows services to remain **loosely coupled**.

## Services

The system includes three microservices:

- accounts-service
- transactions-service
- ai-service

## Event Flow

accounts-service
      |
      v
Kafka Topic: account-events
      |
      v
transactions-service

transactions-service
      |
      v
Kafka Topic: transaction-events
      |
      v
ai-service

## Topics

Recommended topics:

- account-events
- transaction-events

Each service publishes and consumes only the events it needs.

## Message Format

All events should follow the same structure:

{
  eventId: string
  eventType: string
  source: string
  occurredAt: string
  payload: object
}