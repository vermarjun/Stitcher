#!/bin/bash

# Script to add basic type annotations to API calls

# Add type annotation for common API patterns
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Skip if file is in node_modules or is the api.ts file itself
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"/api.ts" ]] || [[ "$file" == *"/api.types.ts" ]]; then
    continue
  fi
  
  # Add <any> to api.get calls that don't have type parameters
  sed -i '' 's/api\.get("/api.get<any>("/g' "$file"
  sed -i '' 's/api\.post("/api.post<any>("/g' "$file"
  sed -i '' 's/api\.put("/api.put<any>("/g' "$file"
  sed -i '' 's/api\.delete("/api.delete<any>("/g' "$file"
  sed -i '' 's/api\.patch("/api.patch<any>("/g' "$file"
  
  # Fix double type parameters (in case they were already there)
  sed -i '' 's/api\.get<any><any>/api.get<any>/g' "$file"
  sed -i '' 's/api\.post<any><any>/api.post<any>/g' "$file"
  sed -i '' 's/api\.put<any><any>/api.put<any>/g' "$file"
  sed -i '' 's/api\.delete<any><any>/api.delete<any>/g' "$file"
  sed -i '' 's/api\.patch<any><any>/api.patch<any>/g' "$file"
done

echo "Type annotations added to API calls"
