class Foo {
  final List<Integer> bar
  Foo() {
    this.bar = new ArrayList<>()
    this.bar.add(1)
    this.bar.add(2)
  }
}

[
  'foo': new Foo(),
  'map': new HashMap<String, Object>()
]