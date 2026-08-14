namespace App.Sample;

using System.Collections.Generic;

/// <summary>class FakeOne { } — 문서 주석은 코드가 아니다.</summary>
public sealed partial class OrderService
{
    // struct FakeTwo { }
    private const string LogPath = @"C:\temp\logs\interface FakeThree { }";

    private const string Json = """
        { "kind": "enum FakeFour { }" }
        """;

    private readonly List<string> _names = new();

    public string Describe(string name) => $"{name} record FakeFive";
}
