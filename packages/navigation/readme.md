# React Router DOM Bridge

This package provides a bridge between React Router and a host application. It allows for navigation between different applications and between different routes within an application.

## Usage
 The packages provides two principal exports:
 - `createRemoteApp`: A function that creates a remote application that can be used to navigate to different routes within the host application.
 - `loadRemoteApp`: A function that can be used to load a remote application into the host application.

### createRemoteApp
 In the remote application create a file that will contain the routes and the root component for the remote application.

```tsx
// routes.tsx
import { createRemoteApp } from 'navigation/router';

const RemoteApp = createRemoteApp({
  routes: [
    { path: '/', element: <div>Home</div> },
    { path: '/about', element: <div>About</div> },
  ],
  basename: '/remote',
  RootComponent: Layout,
});

// app.tsx
import { RemoteApp } from 'routes';
export function App() {
  return <RemoteApp />
}
```
 - `routes`: An array of routes that the remote application will navigate to.(Do not add layout routes here, it will be added in the RootComponent property).
 - `basename`: The base URL for the remote application.
 - `RootComponent`: The root component for the remote application. This component will be used as the template for the remote application.


### loadRemoteApp
In the host application create a file that will contain the routes and the remote application to be loaded.

```tsx
// routes.tsx
import { loadRemoteApp } from 'navigation/router';

const RemoteApp = loadRemoteApp({ RemoteApp: React.lazy(() => import('remote/app')), basename: '/remote' });

const routes = createBrowserRouter([
  {
    path: '/',
    element: <div>Home</div>
  },
  {
    path: '/remote/*',
    element: <RemoteApp />,
  },
]);
```

 - `RemoteApp`: The remote application to be loaded.
 - `basename`: The base URL for the remote application.



 ## Navigating

 ### Navigating between applications
 There is no need to different components or hooks to navigate between applications or routes. You can use the `useNavigate` hook or `Link` component to navigate to different routes.

 ```tsx
 import { useNavigate } from 'react-router-dom';

 // from other remote application
 const navigate = useNavigate();
 navigate('/remote/about');

 <Link to="/remote/about">About</Link>

 // from same remote application
 <Link to="/about">About</Link>

 // from host application
 <Link to="/remote/about">About</Link>
 ```

 ### Navigating from remote to host
 When navigating from a remote application to the host application, you can use all `react-router-dom` hooks and components as usual, but you need to add the `host` prefix to the path.

 ```tsx
 import { useNavigate } from 'react-router-dom';

 const navigate = useNavigate();
 navigate('/host/about');

 <Link to="/host/about">About</Link>
 ```