# Business Partner Related Data API

This document explains how to fetch related data for business partners from the backend.

## Available Endpoints

### 1. Get All Related Data for a Business Partner
**Endpoint:** `GET /api/bpartners/:id/related`

**Description:** Fetches all related data for a specific business partner including projects, shipments, samples, test codes, and contacts.

**Example Request:**
```bash
GET /api/bpartners/64f1a2b3c4d5e6f7g8h9i0j1/related
```

**Example Response:**
```json
{
  "businessPartner": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "name": "ABC Corporation",
    "partnerNumber": "BP001",
    "category": "Client",
    "status": "Active",
    "email": "contact@abccorp.com",
    "phone": "+1-555-0123",
    "address": {
      "address1": "123 Main St",
      "address2": "Suite 100",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "country": "USA"
    }
  },
  "projects": {
    "count": 3,
    "data": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "Project Alpha",
        "description": "Testing project for ABC Corp",
        "status": "Active",
        "bPartnerID": "64f1a2b3c4d5e6f7g8h9i0j1",
        "bPartnerCode": "BP001",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T00:00:00.000Z"
      }
    ]
  },
  "shipments": {
    "count": 2,
    "data": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j3",
        "shipmentOrigin": "New York",
        "shipmentDestination": "Los Angeles",
        "status": "Shipped",
        "bPartnerID": "64f1a2b3c4d5e6f7g8h9i0j1",
        "bPartnerCode": "BP001"
      }
    ],
    "relatedProjects": []
  },
  "samples": {
    "count": 5,
    "data": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j4",
        "name": "Sample 001",
        "description": "Test sample for Project Alpha",
        "bPartnerID": "64f1a2b3c4d5e6f7g8h9i0j1",
        "bPartnerCode": "BP001"
      }
    ]
  },
  "testCodes": {
    "count": 10,
    "data": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j5",
        "code": "TC001",
        "standard": "ISO 9001",
        "descriptionShort": "Quality Test",
        "descriptionLong": "Comprehensive quality testing procedure"
      }
    ]
  },
  "contacts": {
    "count": 2,
    "data": [
      {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j6",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@abccorp.com",
        "phone": "+1-555-0124",
        "position": "Project Manager",
        "bPartnerID": "64f1a2b3c4d5e6f7g8h9i0j1",
        "bPartnerCode": "BP001",
        "isPrimary": true
      }
    ],
    "legacyContactIds": ["CONT001", "CONT002"],
    "note": "Full contact details available"
  },
  "summary": {
    "totalProjects": 3,
    "totalShipments": 2,
    "totalSamples": 5,
    "totalTestCodes": 10,
    "totalContacts": 2
  }
}
```

### 2. Get Business Partner Summary
**Endpoint:** `GET /api/bpartners/:id/summary`

**Description:** Fetches only the summary counts for a business partner (faster for dashboard views).

**Example Request:**
```bash
GET /api/bpartners/64f1a2b3c4d5e6f7g8h9i0j1/summary
```

**Example Response:**
```json
{
  "businessPartner": {
    "id": "64f1a2b3c4d5e6f7g8h9i0j1",
    "name": "ABC Corporation",
    "partnerNumber": "BP001",
    "category": "Client",
    "status": "Active"
  },
  "summary": {
    "totalProjects": 3,
    "totalShipments": 2,
    "totalSamples": 5
  }
}
```

## Data Relationships

The API fetches related data using two methods:
1. **bPartnerID**: Direct reference to the business partner's MongoDB ObjectId
2. **bPartnerCode**: Reference to the business partner's unique partner number

This dual approach ensures that data is found regardless of how the relationship was established in your database.

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `404`: Business partner not found
- `500`: Server error

Error responses include a descriptive message:
```json
{
  "message": "Business partner not found"
}
```

## Usage Examples

### Frontend JavaScript
```javascript
// Fetch all related data
const fetchRelatedData = async (partnerId) => {
  try {
    const response = await fetch(`/api/bpartners/${partnerId}/related`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching related data:', error);
  }
};

// Fetch summary only
const fetchSummary = async (partnerId) => {
  try {
    const response = await fetch(`/api/bpartners/${partnerId}/summary`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching summary:', error);
  }
};
```

### React Component Example
```jsx
import { useState, useEffect } from 'react';

const BusinessPartnerDetails = ({ partnerId }) => {
  const [relatedData, setRelatedData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/bpartners/${partnerId}/related`);
        const data = await response.json();
        setRelatedData(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [partnerId]);

  if (loading) return <div>Loading...</div>;
  if (!relatedData) return <div>Error loading data</div>;

  return (
    <div>
      <h2>{relatedData.businessPartner.name}</h2>
      <p>Projects: {relatedData.summary.totalProjects}</p>
      <p>Shipments: {relatedData.summary.totalShipments}</p>
      <p>Samples: {relatedData.summary.totalSamples}</p>
      <p>Contacts: {relatedData.summary.totalContacts}</p>
    </div>
  );
};
```

## Notes

1. **Contacts Model**: A new contacts model has been created to store detailed contact information. If you have existing contact data stored as strings in other models, the API will show both the new contact details and legacy contact IDs.

2. **Performance**: Use the `/summary` endpoint for dashboard views where you only need counts, and the `/related` endpoint when you need the actual data.

3. **Test Codes**: Currently, test codes are returned for all business partners. If you need to establish a specific relationship between test codes and business partners, update the query in the controller.

4. **Pagination**: For large datasets, consider implementing pagination in future versions.
