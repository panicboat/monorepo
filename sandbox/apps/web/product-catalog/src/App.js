import React, { useState, useEffect } from "react";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // API URL configuration for different environments
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? "/api/v1/products" 
      : "http://localhost:8080/api/v1/products";
    
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching products:", error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading products...</div>
        <div style={{ color: '#666' }}>Fetching data from Product Service (Ruby + gRPC)</div>
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
        <h3>Error loading products</h3>
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
        backgroundColor: '#f3e5f5', 
        borderRadius: '5px',
        border: '1px solid #9c27b0'
      }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#7b1fa2' }}>
          🛍️ Product Catalog
        </h2>
        <p style={{ margin: '0', color: '#8e24aa', fontSize: '14px' }}>
          Powered by Product Service (Ruby + gRPC + PostgreSQL)
        </p>
      </div>

      {products.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{ fontSize: '18px', color: '#6c757d' }}>No products found</p>
        </div>
      ) : (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '20px' 
          }}>
            {products.map((product) => (
              <div 
                key={product.id}
                style={{
                  padding: '20px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  backgroundColor: 'white',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-4px)';
                  e.target.style.boxShadow = '0 8px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    backgroundColor: '#9c27b0',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    marginRight: '15px'
                  }}>
                    📦
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#333' }}>
                      {product.name}
                    </h3>
                    <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                      ID: {product.id}
                    </p>
                  </div>
                  <div style={{ 
                    textAlign: 'right',
                    backgroundColor: '#e8f5e8',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #4caf50'
                  }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>
                      ${product.price}
                    </div>
                  </div>
                </div>

                {product.description && (
                  <div style={{ marginBottom: '15px' }}>
                    <p style={{ 
                      margin: '0', 
                      color: '#555', 
                      fontSize: '14px',
                      lineHeight: '1.4',
                      fontStyle: 'italic'
                    }}>
                      {product.description}
                    </p>
                  </div>
                )}

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  paddingTop: '15px',
                  borderTop: '1px solid #eee'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginRight: '8px'
                    }}>
                      Stock:
                    </span>
                    <span style={{ 
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: product.stock > 10 ? '#e8f5e8' : product.stock > 0 ? '#fff3cd' : '#f8d7da',
                      color: product.stock > 10 ? '#2e7d32' : product.stock > 0 ? '#856404' : '#721c24'
                    }}>
                      {product.stock} units
                    </span>
                  </div>
                  
                  {product.created_at && (
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      Added: {new Date(product.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div style={{ 
                  marginTop: '15px',
                  display: 'flex',
                  gap: '10px'
                }}>
                  <button style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    Add to Cart
                  </button>
                  <button style={{
                    padding: '10px 15px',
                    backgroundColor: 'transparent',
                    color: '#9c27b0',
                    border: '2px solid #9c27b0',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}>
                    ❤️
                  </button>
                </div>
              </div>
            ))}
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
              <strong>Total products: {products.length}</strong>
            </p>
            <p style={{ margin: '10px 0 0 0', fontSize: '12px' }}>
              Catalog powered by Ruby microservice with independent PostgreSQL database
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;