# Testing locally

This project is a frontend-only practice site. Use only the fake data shipped with the repository.

## Install and start

In PowerShell:

```powershell
npm run install:all
npm run dev
```

Visit `http://127.0.0.1:5173`. No backend or database is required.

## Exercise the demo site

Use these fake accounts:

- `alex@example.test` / `password123` owns order 1.
- `casey@example.test` / `password123` has no orders.
- `admin@example.test` / `admin123` is the fake administrator.

Registering a new customer, signing in, sending a contact message, editing a profile, and managing products/users from the admin console exercise the application flows. Data is held in memory and resets on refresh.

## Verification commands

```powershell
npm run build
```

Stop the Vite process with `Ctrl+C`.
