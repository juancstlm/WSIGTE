import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react';
import { Map, Marker } from 'react-mapkit';

export default function Home() {
  const [position, setPosition] = useState();

  return (
    <div className={styles.container} id={'map'}>
      <Map tokenOrCallback={'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlA3WThWVTVaOU4ifQ.eyJpc3MiOiJCMjdRUjNBVUZKIiwiaWF0IjoxNjEyMjU3OTY2LjA0NiwiZXhwIjoxNjEyMjU4OTY2LjA0Niwib3JpZ2luIjoiaHR0cHM6Ly93c2lndGUuY29tIn0.XuM8ffWcOtdMhRjR0pXD9C-t40gmRy7IPs3D6s0Cy1yVK_hs27PARoN5XAD2en7MHRQn-neYN8ZiadA7YgES7A'} center={[37.415, -122.048333]}>
        <Marker latitude={47.6754} longitude={-122.2084} />
      </Map>
    </div>
  )
}
