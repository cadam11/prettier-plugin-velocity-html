class Street {

  final String streetNumber
  Street(String streetNumber) {
    this.streetNumber = streetNumber
  }
  String toString() {
    "Street(${this.streetNumber})"
  }

}

class Address {

  final Street street
  Address(Street street) {
    this.street = street
  }
  String toString() {
    "Address(${this.street})"
  }

}

class Customer {

  final Address address
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

  String title

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

  Customer customer
  App(Customer customer) {
    this.customer = customer
  }

}

class Sun {

  public void setPlanets(String... args) {
  }

}

[
  'foo': new Foo(),
  'map': [:],
  'app': new App(customer),
  'customer': customer,
  'purchase': new Purchase(100),
  'page': new Page(),
  'person': new Person(),
  'sun': new Sun()
]
