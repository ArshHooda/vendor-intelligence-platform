import unittest
from io import BytesIO

from openpyxl import Workbook

from scripts.import_source_files import (
    SheetData,
    SourceRow,
    WorkbookData,
    infer_source_type,
    insert_source_rows,
    parse_workbook,
    validate_import_plan,
)


class ImportSourceFilesTests(unittest.TestCase):
    def test_source_type_is_mapped_to_database_values(self) -> None:
        self.assertEqual(infer_source_type("Bills972.xlsx", {}), "bills")
        self.assertEqual(
            infer_source_type("folder/4DMTVendorListingResults775.xlsx", {}),
            "vendors",
        )
        self.assertEqual(
            infer_source_type("incoming/master.xlsx", {"master.xlsx": "vendors"}),
            "vendors",
        )

    def test_parser_preserves_duplicate_headers_and_ordered_values(self) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Bills"
        sheet.append(["Vendor", "Amount", "Vendor", None])
        sheet.append(["A", 10.5, "A-alt", "tail"])
        output = BytesIO()
        workbook.save(output)
        workbook.close()

        parsed = parse_workbook(output.getvalue(), "Bills.xlsx", "bills")

        self.assertEqual(len(parsed.sheets), 1)
        self.assertEqual(
            parsed.sheets[0].headers,
            ("Vendor", "Amount", "Vendor", "column_4"),
        )
        self.assertEqual(parsed.sheets[0].rows[0].excel_row_number, 2)
        self.assertEqual(
            parsed.sheets[0].rows[0].cell_values,
            ("A", 10.5, "A-alt", "tail"),
        )
        validate_import_plan([parsed])

    def test_preflight_rejects_duplicate_source_type_and_sheet(self) -> None:
        sheet = SheetData(
            name="Data",
            header_row_number=1,
            headers=("ID",),
            rows=(SourceRow(2, ("1",)),),
        )
        books = [
            WorkbookData("one.xlsx", "bills", "a" * 64, (sheet,)),
            WorkbookData("two.xlsx", "bills", "b" * 64, (sheet,)),
        ]

        with self.assertRaisesRegex(RuntimeError, "Duplicate source_type/sheet_name"):
            validate_import_plan(books)

    def test_source_rows_use_cursor_executemany_in_batches(self) -> None:
        calls = []

        class FakeCursor:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_value, traceback):
                return False

            def executemany(self, query, params):
                calls.append((query, list(params)))

        class FakeConnection:
            def cursor(self):
                return FakeCursor()

        sheet = SheetData(
            name="Data",
            header_row_number=1,
            headers=("ID",),
            rows=(SourceRow(2, ("1",)), SourceRow(3, ("2",))),
        )

        insert_source_rows(FakeConnection(), "file-id", sheet, batch_size=1)

        self.assertEqual(len(calls), 2)
        self.assertTrue(all("staging.source_rows" in query for query, _ in calls))
        self.assertEqual([params[0][1] for _, params in calls], [2, 3])


if __name__ == "__main__":
    unittest.main()
