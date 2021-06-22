class Mud {

  final String name
  final int price

  Mud(String name, int price) {
    this.name = name
    this.price = price
  }

}

class Flogger {

  String getPromo(Mud mud) {
    "Mud ${mud.name} is on sale for ${mud.price}"
  }

}

class Customer {

  final String Name
  final Set<Mud> purchasedMud
  Customer(String Name, Set<Mud> purchasedMud) {
    this.Name = Name
    this.purchasedMud = purchasedMud
  }
  boolean hasPurchased(Mud mud) {
    purchasedMud.contains(mud)
  }

}

mudsOnSpecial = [
  new Mud('Mud1', 20),
  new Mud('Mud2', 30),
  new Mud('Mud3', 40)
]

[
  'customer': new Customer('Bob', [mudsOnSpecial[0], mudsOnSpecial[1]].toSet()),
  'mudsOnSpecial': mudsOnSpecial,
  'flogger': new Flogger()
]
