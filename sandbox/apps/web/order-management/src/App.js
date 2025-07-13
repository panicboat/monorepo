import React, { useState, useEffect } from "react";

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newOrder, setNewOrder] = useState({
    user_id: 1,
    items: [{ product_id: 1, quantity: 1, price: 99.99 }]
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = () => {
    // API URL configuration for different environments
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? "/api/v1/orders" 
      : "http://localhost:8080/api/v1/orders";
    
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching orders:", error);
        setError(error.message);
        setLoading(false);
      });
  };

  const handleCreateOrder = (e) => {
    e.preventDefault();
    
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? "/api/v1/orders" 
      : "http://localhost:8080/api/v1/orders";
    
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newOrder),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setOrders([data.order, ...orders]);
        setShowCreateForm(false);
        setNewOrder({
          user_id: 1,
          items: [{ product_id: 1, quantity: 1, price: 99.99 }]
        });
      })
      .catch((error) => {
        console.error("Error creating order:", error);
        alert(`Error creating order: ${error.message}`);
      });
  };

  const getStatusColor = (status) => {
    switch(status.toLowerCase()) {
      case 'completed': return { bg: '#e8f5e8', color: '#2e7d32', border: '#4caf50' };
      case 'pending': return { bg: '#fff3cd', color: '#856404', border: '#ffc107' };
      case 'cancelled': return { bg: '#f8d7da', color: '#721c24', border: '#dc3545' };
      default: return { bg: '#e9ecef', color: '#495057', border: '#6c757d' };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading orders...</div>
        <div style={{ color: '#666' }}>Fetching data from Order Service (TypeScript + gRPC)</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '20px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '5px',
        color: '#856404'
      }}>
        <h3>Error loading orders</h3>
        <p>{error}</p>
        <p style={{ fontSize: '14px', marginTop: '10px' }}>
          Make sure the gRPC Gateway is running on http://localhost:8080
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#e8f4fd', 
        borderRadius: '5px',
        border: '1px solid #2196f3'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>
              📋 Order Management
            </h2>
            <p style={{ margin: '0', color: '#1976d2', fontSize: '14px' }}>
              Powered by Order Service (TypeScript + gRPC + PostgreSQL)
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {showCreateForm ? 'Cancel' : '+ New Order'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Create New Order</h3>
          <form onSubmit={handleCreateOrder}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                User ID:
              </label>
              <input
                type="number"
                value={newOrder.user_id}
                onChange={(e) => setNewOrder({...newOrder, user_id: parseInt(e.target.value)})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                required
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Product ID:
              </label>
              <input
                type="number"
                value={newOrder.items[0].product_id}
                onChange={(e) => setNewOrder({
                  ...newOrder,
                  items: [{...newOrder.items[0], product_id: parseInt(e.target.value)}]
                })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Quantity:
                </label>
                <input
                  type="number"
                  value={newOrder.items[0].quantity}
                  onChange={(e) => setNewOrder({
                    ...newOrder,
                    items: [{...newOrder.items[0], quantity: parseInt(e.target.value)}]
                  })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                  min="1"
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Price:
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newOrder.items[0].price}
                  onChange={(e) => setNewOrder({
                    ...newOrder,
                    items: [{...newOrder.items[0], price: parseFloat(e.target.value)}]
                  })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Create Order
            </button>
          </form>
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{ fontSize: '18px', color: '#6c757d' }}>No orders found</p>
        </div>
      ) : (
        <div>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {orders.map((order) => {
              const statusStyle = getStatusColor(order.status);
              return (
                <div 
                  key={order.id}
                  style={{
                    padding: '20px',
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '15px'
                  }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#333' }}>
                        Order #{order.id}
                      </h3>
                      <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                        User ID: {order.user_id}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                        marginBottom: '8px'
                      }}>
                        {order.status.toUpperCase()}
                      </div>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: 'bold', 
                        color: '#2e7d32' 
                      }}>
                        ${order.total_amount}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <h4 style={{ 
                      margin: '0 0 10px 0', 
                      fontSize: '14px', 
                      color: '#666',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Order Items
                    </h4>
                    <div style={{ 
                      backgroundColor: '#f8f9fa',
                      borderRadius: '6px',
                      padding: '10px'
                    }}>
                      {order.items && order.items.map((item, index) => (
                        <div 
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: index < order.items.length - 1 ? '1px solid #dee2e6' : 'none'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 'bold' }}>
                              Product #{item.product_id}
                            </span>
                            <span style={{ marginLeft: '10px', color: '#666' }}>
                              × {item.quantity}
                            </span>
                          </div>
                          <div style={{ fontWeight: 'bold' }}>
                            ${item.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    paddingTop: '15px',
                    borderTop: '1px solid #eee',
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    <div>
                      Created: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button style={{
                        padding: '5px 10px',
                        backgroundColor: 'transparent',
                        color: '#2196f3',
                        border: '1px solid #2196f3',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}>
                        View Details
                      </button>
                      {order.status === 'pending' && (
                        <button style={{
                          padding: '5px 10px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{ 
            marginTop: '30px', 
            textAlign: 'center', 
            fontSize: '14px', 
            color: '#666',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <p style={{ margin: '0' }}>
              <strong>Total orders: {orders.length}</strong>
            </p>
            <p style={{ margin: '10px 0 0 0', fontSize: '12px' }}>
              Order management powered by TypeScript microservice with independent PostgreSQL database
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;