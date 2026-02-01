
from PIL import Image
import os

def clean_edges(file_path, margin=15):
    try:
        img = Image.open(file_path)
        img = img.convert("RGBA")
        width, height = img.size
        
        datas = img.getdata()
        newData = []
        
        for y in range(height):
            for x in range(width):
                # 픽셀 인덱스 계산
                index = y * width + x
                item = datas[index]
                
                # 왼쪽 가장자리(0 ~ margin) 또는 오른쪽 가장자리(width - margin ~ width)인 경우
                if x < margin or x > width - margin:
                    newData.append((255, 255, 255, 0)) # 투명하게
                else:
                    newData.append(item)
                    
        img.putdata(newData)
        img.save(file_path)
        print(f"Cleaned edges for {file_path}")
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    files_to_clean = ["public/stamps/stamp_2.png", "public/stamps/stamp_5.png", "public/stamps/stamp_8.png"]
    
    for relative_path in files_to_clean:
         # 절대 경로 처리는 실행 위치 기준 상대 경로로 충분할 듯 하지만 혹시 모르니 확인
         if os.path.exists(relative_path):
             clean_edges(relative_path)
         else:
             print(f"File not found: {relative_path}")
