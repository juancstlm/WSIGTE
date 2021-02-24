import axios from 'axios';

//not the real token
const TOKEN = 'A3qPndpKUAYbTPU2HntPTCVBngqJecTehgwtt8gV_KlRQQC-YE5IjXqqHlbmYq112iFJiUyy7DTVNimU7JWc2PYBDbFfdweFmqNMLsAJ8cssC-7-AvtJR370rY0YHYx'

const instance = axios.create({
  baseURL: 'https://api.yelp.com/v3',
  timeout: 2000,
  headers: { 'Authorization': `Bearer ${TOKEN}`}
})

export const getYelpData = (id: string) => {
  instance.get(`/businesses/${id}`)
    .then(function (response) {
      console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    })
    .then(function () {
      // always executed
    });

}
