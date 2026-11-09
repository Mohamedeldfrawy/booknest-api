## BookNest: Practice Project Requirements

## Overview

BookNest is a simple online bookstore API built with Node.js and Express.js. Users can browse books, add them to a cart, place orders.

There is no frontend. Test everything with Postman or a similar tool.

## How to Use This Document

- Build the features in the order listed. Each one builds on the previous.

- Finish, test and commit one feature before starting the next.

## Modules at a Glance

| Area What it covers |
| --- |
| Users Sign-up, login, profiles, roles Books Catalogue, search, stock Cart Items a user wants to buy Orders Checkout and order history Payments Fake payment processing |

## Feature 1: Project Setup

Description: Create the base Express app with the folder structure described above.

## Done when:

- The server starts with one command and connects to the database.

- GET /health returns { "status": "ok" } .

- Any unexpected error returns a clean JSON error, not a crash or stack trace.


## Feature 2: User Registration

Description: New users create an account with name, email and password.

Endpoint: POST /api/users/register

## Business rules:

- Name, email and password are required.

- Two users can't share the same email.

- New users get the customer role by default.

## Done when:

- A user can register and the account is saved.

- Registering again with the same email is rejected with a clear message.

- The response contains the user's details but never the password.

## Feature 3: Login and Authentication

Description: Users log in and receive a token used for protected endpoints.

Endpoint: POST /api/users/login

## Business rules:

- Users log in with email and password.

- Some endpoints are only for logged-in users.

## Done when:

- Correct credentials return a token.

- Wrong credentials are rejected.

- A protected endpoint works with a valid token and is rejected without one.

## Feature 4: User Roles and Profile

Description: Users can view and update their profile. There are two roles: customer and

admin .

Endpoints: GET /api/users/me , PATCH /api/users/me

Business rules:


- A user can update their name only.

- Only admins can do admin actions, like managing books.

- There must be a way to create the first admin.

## Done when:

- A logged-in user can view and update their own profile.

- A customer trying an admin-only action is rejected.

## Feature 5: Book Catalogue (Admin)

Description: Admins can add, edit and delete books.

Endpoints: POST /api/books , PATCH /api/books/:id , DELETE /api/books/:id

Fields: title, author, description, price, category, stock quantity.

## Business rules:

- Only admins can manage books.

- Price must be greater than zero; stock can't be negative.

- A book that appears in past orders should still show correctly in those orders.

## Done when:

- An admin can add, edit and delete a book.

- Invalid data and missing books return clear errors.

## Feature 6: Browse and Search Books

Description: Anyone can list books, view one book, and search.

Endpoints: GET /api/books , GET /api/books/:id

## Business rules:

- No login needed to browse.

- Users can search by title or author, filter by category and price, and sort by price or newest.

- Results come in pages, not all at once.

## Done when:

- Listing, filtering, searching and sorting all work together.


- Asking for a book that doesn't exist returns a not-found error.

## Feature 7: Shopping Cart

Description: Logged-in customers can manage their cart.

Endpoints: GET /api/cart , POST /api/cart/items , PATCH /api/cart/items/:bookId ,

DELETE /api/cart/items/:bookId

## Business rules:

- Each customer has one cart.

- Adding a book that's already in the cart increases its quantity.

- You can't add more copies than are in stock.

## Done when:

- A customer can add, update, remove and view cart items.

- The cart shows each item's price and the total.

## Feature 8: Checkout and Orders

Description: Customers turn their cart into an order and can see their order history.

Endpoints: POST /api/orders , GET /api/orders , GET /api/orders/:id

## Business rules:

- An order is created from the current cart; an empty cart can't be checked out.

- The order keeps the price at the time of purchase, even if the book price changes later.

- Placing an order reduces stock.

- Orders have a status: pending, paid, shipped or cancelled.

- Customers see only their own orders; admins see all and can change status.

## Done when:

- Checkout creates an order, reduces stock and empties the cart.

- Customers can see their order history and one order's details.


## Feature 9: Fake Payments

Description: Simulate paying for an order. No real payment provider.

Endpoint: POST /api/payments

## Business rules:

- Payment takes an order and a fake card number.

- A card ending in 0000 always fails; any other card succeeds.

- A successful payment marks the order as paid.

- An order can't be paid twice.

## Done when:

- Paying with a valid card marks the order as paid.

- A failed payment leaves the order pending.

- Paying an already-paid order is rejected.

## Feature 10: Quality Extras

Description: Polish the project once the main features work.

- Unit tests for services and integration tests for main endpoints.

- Rate limiting on login.

- API documentation (e.g. Swagger).

- Run the app and database with Docker Compose.
