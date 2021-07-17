class Street {

  String streetNumber
  Street(String streetNumber) {
    this.streetNumber = streetNumber
  }
  String toString() {
    "Street(${this.streetNumber})"
  }

}

class Address {

  Street street
  Address(Street street) {
    this.street = street
  }
  String toString() {
    "Address(${this.street})"
  }

}

class Customer {

  String address
  Customer(Address address) {
    this.address = address
  }

}

class Purchase {

  int total
  Purchase(int total) {
    this.total = total
  }

}

class Page {

  String titel

}

class Person {

  List<String> attributes

}

class Foo {

  final List<Integer> bar
  Foo() {
    this.bar = []
    this.bar.add(1)
    this.bar.add(2)
  }

}

customer = new Customer(new Address(new Street('5')))

class App {

  final Customer customer
  App() {
    this.customer = customer
  }

}

class Sun {

  public void setPlanets(String... args) {
  }

}

[
  'foo': new Foo(),
  'map': new HashMap<String, Object>(),
  'customer': customer,
  'purchase': new Purchase(100),
  'page': new Page(),
  'person': new Person(),
  'sun': new Sun()
]
