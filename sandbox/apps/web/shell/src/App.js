import React, { Suspense, useState } from "react";

// Lazy load micro frontends
const UserApp = React.lazy(() => import("userApp/App").catch(() => ({ default: () => <div>User App not available</div> })));
const ProductApp = React.lazy(() => import("productApp/App").catch(() => ({ default: () => <div>Product App not available</div> })));
const OrderApp = React.lazy(() => import("orderApp/App").catch(() => ({ default: () => <div>Order App not available</div> })));

function App() {
  const [currentApp, setCurrentApp] = useState('user');

  const renderCurrentApp = () => {
    switch(currentApp) {
      case 'user':
        return (
          <Suspense fallback={<div>Loading User App...</div>}>
            <UserApp />
          </Suspense>
        );
      case 'product':
        return (
          <Suspense fallback={<div>Loading Product App...</div>}>
            <ProductApp />
          </Suspense>
        );
      case 'order':
        return (
          <Suspense fallback={<div>Loading Order App...</div>}>
            <OrderApp />
          </Suspense>
        );
      default:
        return <div>Select an application from the navigation above.</div>;
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Multi-language Microservice Demo</h1>
        <p>Module Federation + gRPC + Multi-language Services</p>
      </div>
      
      <div className="nav">
        <button 
          className={currentApp === 'user' ? 'active' : ''}
          onClick={() => setCurrentApp('user')}
        >
          Users
        </button>
        <button 
          className={currentApp === 'product' ? 'active' : ''}
          onClick={() => setCurrentApp('product')}
        >
          Products
        </button>
        <button 
          className={currentApp === 'order' ? 'active' : ''}
          onClick={() => setCurrentApp('order')}
        >
          Orders
        </button>
      </div>
      
      <div className="content">
        {renderCurrentApp()}
      </div>
      
      <div style={{ marginTop: '30px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
        <p>
          <strong>Architecture:</strong> User Service (Go) | Product Service (Ruby) | Order Service (TypeScript) | gRPC Gateway (Go)
        </p>
        <p>
          <strong>Frontend:</strong> Shell App (React) | User App (React Remote) | Product App (React Remote) | Order App (React Remote)
        </p>
      </div>
    </div>
  );
}

export default App;