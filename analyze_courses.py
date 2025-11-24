#!/usr/bin/env python3
"""
Script to analyze courses from complete_courses.csv
Counts courses by company, calculates total hours, and shows totals.
"""

import csv
from pathlib import Path
from collections import defaultdict

def main():
    # Path to the CSV file
    csv_path = Path(__file__).parent / "server" / "knowledge" / "certifications" / "complete_courses.csv"
    
    # Read the CSV file and count courses + hours by company
    print(f"Reading file: {csv_path}\n")
    
    company_data = defaultdict(lambda: {'courses': 0, 'hours': 0.0})
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            company = row['company']
            duration = float(row['duration'])
            company_data[company]['courses'] += 1
            company_data[company]['hours'] += duration
    
    # Sort by number of courses (descending)
    sorted_companies = sorted(company_data.items(), key=lambda x: x[1]['courses'], reverse=True)
    
    # Display results
    print("=" * 70)
    print("COURSES AND HOURS BY COMPANY")
    print("=" * 70)
    print()
    
    total_courses = 0
    total_hours = 0.0
    
    for company, data in sorted_companies:
        courses = data['courses']
        hours = data['hours']
        total_courses += courses
        total_hours += hours
        print(f"{company:20s}: {courses:4d} courses  |  {hours:8.1f} hours")
    
    print()
    print("=" * 70)
    print(f"TOTAL: {total_courses} courses  |  {total_hours:.1f} hours")
    print("=" * 70)
    print()

if __name__ == "__main__":
    main()

