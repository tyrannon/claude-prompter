# Multi-Shot Comparison

**Run ID**: me4y3kju-fauun\n**Timestamp**: 2025-08-10T00:28:40.221Z\n**Total Engines**: 2\n**Successful**: 2\n**Failed**: 0\n\n## Original Prompt
```
help me implement React authentication with JWT tokens
```

## Successful Results

### gpt-5-nano (gpt-5-nano)
**Execution Time**: 14606ms\n\nTo implement authentication in a React application using JWT (JSON Web Tokens), you need both a frontend (React) and a backend (Node.js/Express or any other server-side technology). Here's a basic outline:

### Backend (Node.js/Express):

1. **Install Dependencies**: 
   ```bash
   npm install express jsonwebtoken bcryptjs body-parser cors
   ```

2. **Set Up Express Server**:
   ```javascript
   const express = require('express');
   const jwt = require('jsonwebtoken');
   const bcrypt = require('bcryptjs');
   const bodyParser = require('body-parser');
   const cors = require('cors');

   const app = express();
   app.use(bodyParser.json());
   app.use(cors());

   const users = []; // This should be replaced with a real database

   const SECRET_KEY = 'your-secret-key';

   app.post('/register', async (req, res) => {
     const { username, password } = req.body;
     const hashedPassword = await bcrypt.hash(password, 10);
     users.push({ username, password: hashedPassword });
     res.sendStatus(201);
   });

   app.post('/login', async (req, res) => {
     const { username, password } = req.body;
     const user = users.find(u => u.username === username);
     if (user && await bcrypt.compare(password, user.password)) {
       const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
       res.json({ token });
     } else {
       res.sendStatus(401);
     }
   });

   app.listen(4000, () => {
     console.log('Server running on port 4000');
   });
   ```

### Frontend (React):

1. **Set Up React App**:
   ```bash
   npx create-react-app jwt-auth
   cd jwt-auth
   npm install axios
   ```

2. **Create Authentication Functions**:
   ```javascript
   import axios from 'axios';

   const API_URL = 'http://localhost:4000';

   export const register = (username, password) => {
     return axios.post(`${API_URL}/register`, { username, password });
   };

   export const login = async (username, password) => {
     const response = await axios.post(`${API_URL}/login`, { username, password });
     if (response.data.token) {
       localStorage.setItem('token', response.data.token);
     }
     return response.data;
   };

   export const logout = () => {
     localStorage.removeItem('token');
   };

   export const getCurrentUser = () => {
     return localStorage.getItem('token');
   };
   ```

3. **Create a Simple Login Component**:
   ```jsx
   import React, { useState } from 'react';
   import { login } from './authService';

   const Login = () => {
     const [username, setUsername] = useState('');
     const [password, setPassword] = useState('');

     const handleSubmit = async (e) => {
       e.preventDefault();
       try {
         await login(username, password);
         alert('Login successful');
       } catch {
         alert('Login failed');
       }
     };

     return (
       <form onSubmit={handleSubmit}>
         <input
           type="text"
           value={username}
           onChange={(e) => setUsername(e.target.value)}
           placeholder="Username"
           required
         />
         <input
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           placeholder="Password"
           required
         />
         <button type="submit">Login</button>
       </form>
     );
   };

   export default Login;
   ```

### Important Notes:

- This example uses an in-memory array to store users; replace it with a real database in production.
- Implement proper error handling and validation.
- Use HTTPS in production to secure data in transit.
- Store the secret key (`SECRET_KEY`) securely and consider using environment variables.
- Consider token expiration and refresh logic for production-level applications.

---

### gpt-5-mini (gpt-5-mini)
**Execution Time**: 18171ms\n\nImplementing authentication in a React application using JWT (JSON Web Tokens) involves several steps, both on the client side and the server side. Here's a general guide to help you set it up:

### Step 1: Backend Setup

First, ensure your server can issue JWTs. For this, you typically need a server-side framework like Express.js with Node.js. Here's a brief overview:

1. **Install Necessary Packages**:
   ```bash
   npm install express jsonwebtoken bcryptjs cors
   ```

2. **Basic Server Setup**:
   Create a simple server that can handle authentication requests.

   ```javascript
   const express = require('express');
   const jwt = require('jsonwebtoken');
   const bcrypt = require('bcryptjs');
   const cors = require('cors');

   const app = express();
   const PORT = process.env.PORT || 5000;

   app.use(cors());
   app.use(express.json());

   const users = []; // This is just for demonstration. Use a database in production.

   app.post('/register', async (req, res) => {
     const { username, password } = req.body;
     const hashedPassword = await bcrypt.hash(password, 10);
     users.push({ username, password: hashedPassword });
     res.status(201).send('User registered');
   });

   app.post('/login', async (req, res) => {
     const { username, password } = req.body;
     const user = users.find(u => u.username === username);

     if (user && await bcrypt.compare(password, user.password)) {
       const token = jwt.sign({ username: user.username }, 'your_jwt_secret', { expiresIn: '1h' });
       res.json({ token });
     } else {
       res.status(401).send('Invalid credentials');
     }
   });

   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
   ```

### Step 2: Frontend Setup

Here’s how you can implement JWT authentication on the client side using React:

1. **Install Axios**:
   ```bash
   npm install axios
   ```

2. **Create Authentication Service**:
   Create a service to handle API requests related to authentication.

   ```javascript
   // authService.js
   import axios from 'axios';

   const API_URL = 'http://localhost:5000';

   const register = async (username, password) => {
     return axios.post(`${API_URL}/register`, { username, password });
   };

   const login = async (username, password) => {
     const response = await axios.post(`${API_URL}/login`, { username, password });
     if (response.data.token) {
       localStorage.setItem('token', response.data.token);
     }
     return response.data;
   };

   const logout = () => {
     localStorage.removeItem('token');
   };

   export default {
     register,
     login,
     logout,
   };
   ```

3. **Implement Authentication in React Components**:

   ```javascript
   // App.js
   import React, { useState } from 'react';
   import authService from './authService';

   function App() {
     const [username, setUsername] = useState('');
     const [password, setPassword] = useState('');
     const [message, setMessage] = useState('');

     const handleRegister = async () => {
       try {
         await authService.register(username, password);
         setMessage('User registered successfully!');
       } catch (error) {
         setMessage('Error registering user');
       }
     };

     const handleLogin = async () => {
       try {
         await authService.login(username, password);
         setMessage('Logged in successfully!');
       } catch (error) {
         setMessage('Error logging in');
       }
     };

     const handleLogout = () => {
       authService.logout();
       setMessage('Logged out');
     };

     return (
       <div>
         <h1>React JWT Authentication</h1>
         <input
           type="text"
           placeholder="Username"
           value={username}
           onChange={(e) => setUsername(e.target.value)}
         />
         <input
           type="password"
           placeholder="Password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
         />
         <button onClick={handleRegister}>Register</button>
         <button onClick={handleLogin}>Login</button>
         <button onClick={handleLogout}>Logout</button>
         <p>{message}</p>
       </div>
     );
   }

   export default App;
   ```

### Step 3: Protect Routes

To protect routes based on authentication, you can create a higher-order component (HOC) or use React Router's built-in mechanisms.

Here's a simple way to protect routes:

```javascript
// PrivateRoute.js
import React from 'react';
import { Route, Redirect } from 'react-router-dom';

const PrivateRoute = ({ component: Component, ...rest }) => {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Route
      {...rest}
      render={props =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  );
};

export default PrivateRoute;
```

### Additional Considerations

- **Security**: Always use HTTPS in production to secure JWTs in transit.
- **Token Expiry**: Handle token expiry on both client and server to ensure users are logged out when tokens expire.
- **Refresh Tokens**: Implement refresh tokens if you want to maintain user sessions without forcing them to log in again frequently.
- **Environment Variables**: Use environment variables to manage sensitive data like JWT secrets.

This guide provides a simple setup. You can expand it with better error handling, more secure storage practices, and a more robust backend setup.

---

