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

  const handleImportFile = async (filename) => {
    setLoading(true);
    setResults(null);

    try {
      const response = await axios.post(`http://localhost:5000/api/erp-import/import/${filename}`);
      setResults(response.data);
      loadPendingFiles(); // Refresh list
    } catch (error) {
      setResults({
        success: false,
        error: error.response?.data?.error || error.message,
        errors: error.response?.data?.errors || []
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
        Import product data from ERP system. Place CSV files in the <code>erp_import/</code> directory.
      </p>

      {/* Results Display */}
      {results && (
        <div style={results.success ? styles.successBox : styles.errorBox}>
          <h3>{results.success ? '✅ Import Successful' : '❌ Import Failed'}</h3>
          
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
                  {r.errors.length > 0 && (
                    <ul style={styles.errorList}>
                      {r.errors.map((err, j) => <li key={j}>{err}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Single file imported
            <div>
              {results.filename && <p><strong>File:</strong> {results.filename}</p>}
              {results.imported !== undefined && <p><strong>New Products:</strong> {results.imported}</p>}
              {results.updated !== undefined && <p><strong>Updated Products:</strong> {results.updated}</p>}
              
              {results.errors && results.errors.length > 0 && (
                <div>
                  <h4>Errors:</h4>
                  <ul style={styles.errorList}>
                    {results.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <button 
            onClick={() => navigate('/')} 
            style={styles.viewProductsButton}
          >
            View Products
          </button>
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
            No files pending. Place CSV files from ERP system in <code>erp_import/</code> directory.
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
                  <td>{file.name}</td>
                  <td>{(file.size / 1024).toFixed(2)} KB</td>
                  <td>{new Date(file.modified).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => handleImportFile(file.name)}
                      style={styles.importButton}
                      disabled={loading}
                    >
                      Import
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Instructions */}
      <div style={styles.infoBox}>
        <h4>Expected CSV Format:</h4>
        <pre style={styles.pre}>
{`product_id,name,description,price
1,"Laptop","High-performance laptop",999.99
2,"Mouse","Wireless mouse",29.99`}
        </pre>
        <p><strong>Required fields:</strong> product_id, name, price</p>
        <p><strong>Optional fields:</strong> description</p>
      </div>
    </div>
  );
}

const styles = {
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