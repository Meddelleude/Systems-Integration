import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ERPImport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPendingFiles();
  }, []);

  const loadPendingFiles = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/erp-import/pending');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleImportFile = async (file) => {
  setLoading(true);
  setResults(null);

  try {
    let endpoint;
    
    if (file.type === 'products') {
      endpoint = `http://localhost:5000/api/erp-import/import/products/${file.name}`;
    } else if (file.type === 'customers') {
      endpoint = `http://localhost:5000/api/erp-import/import/customers/${file.name}`;
    } else if (file.type === 'orderstatus') {
      endpoint = `http://localhost:5000/api/erp-import/import/orderstatus/${file.name}`;
    } else {
      throw new Error('Unknown file type');
    }
    
    const response = await axios.post(endpoint);
    setResults(response.data);
    loadPendingFiles();
  } catch (error) {
    // Verbesserte Fehlerbehandlung
    const errorData = error.response?.data;
    
    if (errorData) {
      // Backend hat detaillierte Fehlerdaten zurückgegeben
      setResults({
        success: false,
        filename: errorData.filename || file.name,
        error: errorData.error,
        errors: errorData.errors || [],
        imported: errorData.imported || 0,
        updated: errorData.updated || 0
      });
    } else {
      // Generischer Fehler
      setResults({
        success: false,
        filename: file.name,
        error: error.message,
        errors: []
      });
    }
  } finally {
    setLoading(false);
  }
};
const handleDeleteFile = async (filename) => {
  if (!window.confirm(`Are you sure you want to delete ${filename}?`)) {
    return;
  }

  setLoading(true);

  try {
    const response = await axios.delete(`http://localhost:5000/api/erp-import/delete/${filename}`);
    
    if (response.data.success) {
      setResults({
        success: true,
        message: `✅ ${response.data.message}`
      });
      loadPendingFiles(); // Refresh list
    }
  } catch (error) {
    setResults({
      success: false,
      error: `Failed to delete file: ${error.message}`
    });
  } finally {
    setLoading(false);
  }
};
  const handleImportAll = async () => {
    if (!window.confirm('Import all pending files?')) return;

    setLoading(true);
    setResults(null);

    try {
      const response = await axios.post('http://localhost:5000/api/erp-import/import-all');
      setResults(response.data);
      loadPendingFiles();
    } catch (error) {
      setResults({
        success: false,
        error: error.response?.data?.error || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>ERP Product Import</h2>
      <p style={styles.description}>
        Import product data from ERP system.
      </p>

      {/* Results Display */}
{results && (
  <div style={results.success ? styles.successBox : styles.errorBox}>
    <h3>{results.success ? '✅ Success' : '❌ Failed'}</h3>
    
    {/* Nachricht anzeigen (für Delete oder einfache Operationen) */}
    {results.message && (
      <p style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
        {results.message}
      </p>
    )}
    
    {/* Import-spezifische Details */}
    {results.results ? (
      // Multiple files imported
      <div>
        <p>Processed {results.totalFiles} file(s), {results.successful} successful</p>
        {results.results.map((r, i) => (
          <div key={i} style={styles.resultItem}>
            <strong>{r.filename}:</strong> 
            {r.success ? (
              <span> Imported: {r.imported}, Updated: {r.updated}</span>
            ) : (
              <span style={{color: 'red'}}> Failed</span>
            )}
            {r.errors && r.errors.length > 0 && (
              <ul style={styles.errorList}>
                {r.errors.map((err, j) => <li key={j}>{err}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    ) : results.filename ? (
      // Single file imported
      <div>
        <p><strong>File:</strong> {results.filename}</p>
        {results.imported !== undefined && <p><strong>New Items:</strong> {results.imported}</p>}
        {results.updated !== undefined && <p><strong>Updated Items:</strong> {results.updated}</p>}
        
        {results.errors && results.errors.length > 0 && (
          <div>
            <h4>Errors:</h4>
            <ul style={styles.errorList}>
              {results.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>
    ) : null}
    
    {/* Error-Anzeige */}
    {results.error && (
      <p style={{ color: results.success ? 'inherit' : '#721c24', marginTop: '0.5rem' }}>
        {results.error}
      </p>
    )}
    
    {/* View Products Button nur bei Import */}
    {results.success && (results.imported > 0 || results.updated > 0) && (
      <button 
        onClick={() => navigate('/')} 
        style={styles.viewProductsButton}
      >
        View Products
      </button>
    )}
  </div>
)}

      {/* Pending Files */}
      <div style={styles.section}>
        <div style={styles.header}>
          <h3>Pending Import Files</h3>
          <div>
            <button 
              onClick={loadPendingFiles} 
              style={styles.refreshButton}
              disabled={loading}
            >
              🔄 Refresh
            </button>
            {files.length > 0 && (
              <button 
                onClick={handleImportAll} 
                style={styles.importAllButton}
                disabled={loading}
              >
                Import All ({files.length})
              </button>
            )}
          </div>
        </div>

        {loading && <p>Processing...</p>}

        {files.length === 0 ? (
          <p style={styles.noFiles}>
            No files pending. 
          </p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Filename</th>
                <th>Size</th>
                <th>Modified</th>
                <th>Action</th>
              </tr>
            </thead>
              <tbody>
  {files.map((file, index) => (
    <tr key={index}>
      <td>
        {file.name}
        {file.type !== 'unknown' && (
          <span style={{
            marginLeft: '0.5rem',
            padding: '0.2rem 0.5rem',
            backgroundColor: 
              file.type === 'products' ? '#007bff' : 
              file.type === 'customers' ? '#28a745' :
              file.type === 'orderstatus' ? '#ffc107' : '#6c757d',
            color: 'white',
            borderRadius: '4px',
            fontSize: '0.75rem'
          }}>
            {file.type}
          </span>
        )}
      </td>
      <td>{(file.size / 1024).toFixed(2)} KB</td>
      <td>{new Date(file.modified).toLocaleString()}</td>
      <td>
        <div style={styles.actionButtons}>
          <button
            onClick={() => handleImportFile(file)}
            style={styles.importButton}
            disabled={loading || file.type === 'unknown'}
          >
            📥 Import
          </button>
          <button
            onClick={() => handleDeleteFile(file.name)}
            style={styles.deleteButton}
            disabled={loading}
          >
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>
          </table>
        )}
      </div>
      {/* Instructions */}
<div style={styles.infoBox}>
  <h4> Supported File Types:</h4>
  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
    <li><strong>Products:</strong> File name must contain "product"</li>
    <li><strong>Customers:</strong> File name must contain "customer"</li>
    <li><strong>Order Status:</strong> File name must contain "orderstatus"</li>
  </ul>
  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
    
  </p>
</div>
    </div>
  );
}

const styles = {
   actionButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
  importButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  container: {
    maxWidth: '1000px',
    margin: '2rem auto',
    padding: '0 1rem',
  },
  description: {
    color: '#666',
    marginBottom: '2rem',
  },
  section: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    marginBottom: '2rem',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  refreshButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '0.5rem',
  },
  importAllButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  importButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  noFiles: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '2rem',
  },
  successBox: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    color: '#155724',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '2rem',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    color: '#721c24',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '2rem',
  },
  errorList: {
    marginTop: '0.5rem',
    paddingLeft: '1.5rem',
  },
  resultItem: {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #ddd',
  },
  viewProductsButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    padding: '1.5rem',
    borderRadius: '8px',
  },
  pre: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '4px',
    overflow: 'auto',
  },
};

export default ERPImport;