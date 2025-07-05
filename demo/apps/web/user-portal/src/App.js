import React, { useState, useEffect } from "react";

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // API URL configuration for different environments
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? "/api/v1/users" 
      : "http://localhost:8080/api/v1/users";
    
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching users:", error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading users...</div>
        <div style={{ color: '#666' }}>Fetching data from User Service (Go + gRPC)</div>
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
        <h3>Error loading users</h3>
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
        backgroundColor: '#e3f2fd', 
        borderRadius: '5px',
        border: '1px solid #2196f3'
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
          👥 User Management
        </h2>
        <p style={{ margin: '0', color: '#1565c0', fontSize: '14px' }}>
          Powered by User Service (Go + gRPC + PostgreSQL)
        </p>
      </div>

      {users.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{ fontSize: '18px', color: '#6c757d' }}>No users found</p>
        </div>
      ) : (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '15px' 
          }}>
            {users.map((user) => (
              <div 
                key={user.id}
                style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#2196f3',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    marginRight: '10px'
                  }}>
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 style={{ margin: '0', fontSize: '16px', color: '#333' }}>
                      {user.name}
                    </h3>
                    <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                      ID: {user.id}
                    </p>
                  </div>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#555' }}>Email:</strong>
                  <span style={{ marginLeft: '8px', color: '#333' }}>{user.email}</span>
                </div>
                {user.created_at && (
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    Created: {new Date(user.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div style={{ 
            marginTop: '20px', 
            textAlign: 'center', 
            fontSize: '14px', 
            color: '#666' 
          }}>
            <p>Total users: {users.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;