/// <reference path="../node_modules/mapkit-typescript/mapkit/index.d.ts" />

declare namespace mapkit {
  interface Place {
    id: string;
    telephone?: string;
    urls?: string[];
  }

  interface SearchConstructorOptions {
    pointOfInterestFilter?: PointOfInterestFilter;
  }

  interface PointOfInterestFilter {
    readonly filterType: string;
  }

  namespace PointOfInterestFilter {
    function including(categories: PointOfInterestCategory[]): PointOfInterestFilter;
    function excluding(categories: PointOfInterestCategory[]): PointOfInterestFilter;
  }

  enum PointOfInterestCategory {
    Airport = "Airport",
    AmusementPark = "AmusementPark",
    Aquarium = "Aquarium",
    ATM = "ATM",
    Bakery = "Bakery",
    Bank = "Bank",
    Beach = "Beach",
    Brewery = "Brewery",
    Cafe = "Cafe",
    Campground = "Campground",
    CarRental = "CarRental",
    EVCharger = "EVCharger",
    FireStation = "FireStation",
    FitnessCenter = "FitnessCenter",
    FoodMarket = "FoodMarket",
    GasStation = "GasStation",
    Hospital = "Hospital",
    Hotel = "Hotel",
    Laundry = "Laundry",
    Library = "Library",
    Marina = "Marina",
    MovieTheater = "MovieTheater",
    Museum = "Museum",
    NationalPark = "NationalPark",
    Nightlife = "Nightlife",
    Park = "Park",
    Parking = "Parking",
    Pharmacy = "Pharmacy",
    Police = "Police",
    PostOffice = "PostOffice",
    PublicTransport = "PublicTransport",
    Restaurant = "Restaurant",
    Restroom = "Restroom",
    School = "School",
    Stadium = "Stadium",
    Store = "Store",
    Theater = "Theater",
    University = "University",
    Winery = "Winery",
    Zoo = "Zoo",
  }
}
