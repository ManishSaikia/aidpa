from unittest.mock import patch

def test_home(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"] == {"status": "ok"}
    assert data["error"] is None

def test_upload_csv_success(client):
    # In-memory CSV data
    csv_data = "name,age,city\nAlice,30,New York\nBob,25,Los Angeles\nCharlie,,Chicago\n"
    file_payload = {"file": ("test.csv", csv_data, "text/csv")}
    
    response = client.post("/upload", files=file_payload)
    assert response.status_code == 200
    envelope = response.json()
    assert envelope["success"] is True
    assert envelope["error"] is None
    
    data = envelope["data"]
    assert data["message"] == "CSV upload successful."
    assert data["filename"] == "test.csv"
    assert data["columns"] == ["name", "age", "city"]
    assert data["rows"] == 3
    assert data["dtype"]["age"] == "float64"  # age contains a null/missing value, so pandas parses it as float64
    assert data["nulls"]["age"] == 1

def test_upload_invalid_file(client):
    file_payload = {"file": ("test.txt", "Plain text contents", "text/plain")}
    response = client.post("/upload", files=file_payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"]["code"] == "BAD_REQUEST"
    assert "Invalid file" in data["error"]["message"]

def test_upload_missing_file(client):
    # Send empty payload to trigger a validation error
    response = client.post("/upload", files={})
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert data["error"]["details"] is not None

def test_upload_unhandled_exception():
    from fastapi.testclient import TestClient
    from main import app
    
    # Instantiate a client that does not re-raise unhandled exceptions
    local_client = TestClient(app, raise_server_exceptions=False)
    
    # Mock analyze_csv_data to raise a generic exception, ensuring the traceback is caught globally
    with patch("routers.upload.analyze_csv_data", side_effect=RuntimeError("Simulated server crash")):
        csv_data = "name,age,city\nAlice,30,New York\n"
        file_payload = {"file": ("test.csv", csv_data, "text/csv")}
        response = local_client.post("/upload", files=file_payload)
        
    assert response.status_code == 500
    data = response.json()
    assert data["success"] is False
    assert data["data"] is None
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert "An unexpected server error" in data["error"]["message"]
    assert data["error"]["details"] is None
