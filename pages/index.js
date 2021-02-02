import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react';
import { Map, Marker } from 'react-mapkit';

export default function Home() {
  const [position, setPosition] = useState();
  const [token, setToken] = useState();


  useEffect(()=>{
      fetch("https://api.wsigte.com/token")
        .then(res => {
          setToken(res.text());
        })
  },[])

  return (
    <div className={styles.container} id={'map'}>
      {token ? <Map tokenOrCallback={token} center={[37.415, -122.048333]}>
        <Marker latitude={47.6754} longitude={-122.2084} />
      </Map> : null}
    </div>
  )
}
