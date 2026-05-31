import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const fallbackReferenceData = {
  regions: [],
  addressData: [],
  ethnicGroups: [],
  occupations: [],
};

export async function fetchReferenceData() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/reference-data`);

    if (!response.ok) {
      throw new Error(`Khong tai duoc du lieu tham chieu: ${response.status}`);
    }

    const payload = await response.json();
    const data = payload?.data || {};

    return {
      regions: Array.isArray(data.regions) ? data.regions : [],
      addressData: Array.isArray(data.addressData) ? data.addressData : [],
      ethnicGroups: Array.isArray(data.ethnicGroups) ? data.ethnicGroups : [],
      occupations: Array.isArray(data.occupations) ? data.occupations : [],
    };
  } catch (error) {
    console.error(error);
    return fallbackReferenceData;
  }
}

const ReferenceDataContext = createContext(fallbackReferenceData);

export function ReferenceDataProvider({ children }) {
  const [referenceData, setReferenceData] = useState(fallbackReferenceData);

  useEffect(() => {
    let isMounted = true;

    fetchReferenceData().then((data) => {
      if (isMounted) {
        setReferenceData(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(() => referenceData, [referenceData]);

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData() {
  return useContext(ReferenceDataContext);
}
